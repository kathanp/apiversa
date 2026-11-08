package io.github.kathanp.apiversa.maven;

import java.io.File;
import org.apache.maven.plugin.AbstractMojo;
import org.apache.maven.plugin.MojoFailureException;
import org.apache.maven.plugins.annotations.Mojo;
import org.apache.maven.plugins.annotations.Parameter;

/** Writes plain change functions and a route list. */
@Mojo(name = "eject", requiresProject = true)
public class EjectMojo extends AbstractMojo {
    @Parameter(property = "apiversa.dir", defaultValue = "${project.basedir}/src/main/resources/api-versions")
    private File dir;

    @Parameter(property = "apiversa.out", required = true)
    private File out;

    @Override
    public void execute() throws MojoFailureException {
        try {
            for (java.nio.file.Path file : Eject.eject(dir.toPath(), out.toPath())) getLog().info("wrote " + file);
        } catch (Exception exception) {
            throw new MojoFailureException(exception.getMessage(), exception);
        }
    }
}
