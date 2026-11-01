package io.github.kathanp.apiversa.maven;

import io.github.kathanp.apiversa.Engine;
import io.github.kathanp.apiversa.TrafficReplay;
import java.io.File;
import java.nio.file.Files;
import java.util.List;
import org.apache.maven.plugin.AbstractMojo;
import org.apache.maven.plugin.MojoFailureException;
import org.apache.maven.plugins.annotations.Mojo;
import org.apache.maven.plugins.annotations.Parameter;

/** Replay a host-supplied samples file. A different response fails the build. */
@Mojo(name = "replay", requiresProject = true)
public class ReplayMojo extends AbstractMojo {
    @Parameter(property = "apiversa.dir", defaultValue = "${project.basedir}/src/main/resources/api-versions")
    private File dir;

    @Parameter(property = "apiversa.samples", required = true)
    private File samples;

    @Parameter(property = "apiversa.today")
    private String today;

    @Override
    public void execute() throws MojoFailureException {
        try {
            Engine.Bundle bundle = PluginGoals.load(dir.toPath(), today);
            List<String> diffs = TrafficReplay.differences(bundle, Files.readString(samples.toPath()));
            if (!diffs.isEmpty()) throw new MojoFailureException(String.join("\n", diffs));
            getLog().info("apiversa replay: no differences");
        } catch (MojoFailureException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new MojoFailureException(exception.getMessage() == null ? "replay failed" : exception.getMessage(), exception);
        }
    }
}
