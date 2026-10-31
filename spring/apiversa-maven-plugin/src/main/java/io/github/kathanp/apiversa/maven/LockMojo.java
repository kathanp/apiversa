package io.github.kathanp.apiversa.maven;

import java.io.File;
import org.apache.maven.plugin.AbstractMojo;
import org.apache.maven.plugin.MojoFailureException;
import org.apache.maven.plugins.annotations.Mojo;
import org.apache.maven.plugins.annotations.Parameter;

/** Writes {@code api-versions/.lock.json} with the SHA-256 of each change file. */
@Mojo(name = "lock", requiresProject = true)
public class LockMojo extends AbstractMojo {
    @Parameter(property = "apiversa.dir", defaultValue = "${project.basedir}/src/main/resources/api-versions")
    private File dir;

    @Override
    public void execute() throws MojoFailureException {
        try {
            getLog().info("wrote " + PluginGoals.lock(dir.toPath()));
        } catch (Exception exception) {
            throw new MojoFailureException(exception.getMessage(), exception);
        }
    }
}
