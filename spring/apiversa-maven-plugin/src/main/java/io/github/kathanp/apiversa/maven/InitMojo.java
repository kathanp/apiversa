package io.github.kathanp.apiversa.maven;

import java.io.File;
import org.apache.maven.plugin.AbstractMojo;
import org.apache.maven.plugin.MojoFailureException;
import org.apache.maven.plugins.annotations.Mojo;
import org.apache.maven.plugins.annotations.Parameter;

/** Creates {@code api-versions/}, {@code versions.yaml}, and one commented example change file. */
@Mojo(name = "init", requiresProject = true)
public class InitMojo extends AbstractMojo {
    @Parameter(defaultValue = "${project.basedir}")
    private File directory;

    @Override
    public void execute() throws MojoFailureException {
        try {
            getLog().info("created " + PluginGoals.init(directory.toPath()));
        } catch (Exception exception) {
            throw new MojoFailureException(exception.getMessage() == null ? "Change file failed validation." : exception.getMessage(), exception);
        }
    }
}
